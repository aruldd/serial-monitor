import React, { useMemo, useCallback } from 'react';
import { Group, Text, Code, ActionIcon, Box } from '@mantine/core';
import { IconCopy, IconArrowRight, IconArrowLeft } from '@tabler/icons-react';
import { useIntl } from 'react-intl';
import { SerialMessage, DataFormat, SerialConnectionConfig } from '../types';
import { bytesToString } from '../utils/formatConverter';

/**
 * Highlight CR and LF characters in the display text
 */
function highlightLineEndings(text: string, format: DataFormat): React.ReactNode {
  if (format === 'hex') {
    // For hex format, highlight 0D (CR) and 0A (LF) as complete hex bytes
    // Hex format is space-separated like "ff 0d 0a 00"
    const parts: React.ReactNode[] = [];
    const words = text.split(/(\s+)/); // Split by whitespace but keep separators
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const upperWord = word.toUpperCase();
      
      if (upperWord === '0D' || upperWord === '0A') {
        const isCR = upperWord === '0D';
        parts.push(
          <span
            key={i}
            style={{
              backgroundColor: isCR ? 'var(--mantine-color-orange-2)' : 'var(--mantine-color-cyan-2)',
              color: isCR ? 'var(--mantine-color-orange-9)' : 'var(--mantine-color-cyan-9)',
              padding: '2px 4px',
              borderRadius: '3px',
              fontWeight: 600,
            }}
            title={isCR ? 'Carriage Return (CR, \\r, 0x0D)' : 'Line Feed (LF, \\n, 0x0A)'}
          >
            {word}
          </span>
        );
      } else {
        parts.push(word);
      }
    }
    
    return parts.length > 0 ? parts : text;
  } else if (format === 'ascii' || format === 'utf8') {
    // For ASCII/UTF-8, highlight actual \r and \n characters
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '\r' || char === '\n') {
        // Add text before this character
        if (i > lastIndex) {
          parts.push(text.substring(lastIndex, i));
        }
        
        // Add highlighted character
        const isCR = char === '\r';
        parts.push(
          <span
            key={i}
            style={{
              backgroundColor: isCR ? 'var(--mantine-color-orange-2)' : 'var(--mantine-color-cyan-2)',
              color: isCR ? 'var(--mantine-color-orange-9)' : 'var(--mantine-color-cyan-9)',
              padding: '2px 4px',
              borderRadius: '3px',
              fontWeight: 600,
            }}
            title={isCR ? 'Carriage Return (CR, \\r)' : 'Line Feed (LF, \\n)'}
          >
            {isCR ? '\\r' : '\\n'}
          </span>
        );
        
        lastIndex = i + 1;
      }
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  } else {
    // For other formats, return as-is
    return text;
  }
}

interface MessageItemProps {
  message: SerialMessage;
  onResend?: (data: string, format: DataFormat, config: SerialConnectionConfig) => Promise<void>;
  isConnected?: boolean;
  currentConfig?: SerialConnectionConfig;
  displayFormat?: DataFormat; // Override format for display
}

function MessageItemComponent({ message, onResend, isConnected, currentConfig, displayFormat }: MessageItemProps) {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: key });
  
  // Memoize expensive calculations
  const formatToUse = useMemo(() => displayFormat || message.format, [displayFormat, message.format]);
  const displayText = useMemo(() => bytesToString(message.data, formatToUse), [message.data, formatToUse]);
  const highlightedText = useMemo(() => highlightLineEndings(displayText, formatToUse), [displayText, formatToUse]);
  const isSent = useMemo(() => message.type === 'sent', [message.type]);
  const canResend = useMemo(
    () => isSent && isConnected && message.originalData && onResend && currentConfig,
    [isSent, isConnected, message.originalData, onResend, currentConfig]
  );
  
  const handleClick = useCallback(() => {
    if (canResend && message.originalData && onResend && currentConfig) {
      onResend(message.originalData, message.format, currentConfig);
    }
  }, [canResend, message.originalData, message.format, onResend, currentConfig]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayText);
    } catch (err) {
      console.error('[MessageHistory] Failed to copy:', err);
    }
  }, [displayText]);
  
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Box 
      px="md"
      onClick={canResend ? handleClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: canResend ? 'pointer' : 'default',
        transition: 'opacity 0.2s',
        position: 'relative',
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        {/* Left side: Metadata */}
        <Box
          style={{
            minWidth: 120,
            flexShrink: 0,
            backgroundColor: 'var(--mantine-color-gray-1)',
            padding: '8px',
            borderRadius: '4px',
          }}
        >
          <Group gap={4}>
            {isSent ? (
              <IconArrowLeft size={16} color="var(--mantine-color-blue-6)" />
            ) : (
              <IconArrowRight size={16} color="var(--mantine-color-green-6)" />
            )}
            <Text size="sm" >
              {message.timestamp.toLocaleTimeString()}
            </Text>
          </Group>
        </Box>
        
        {/* Right side: Message content */}
        <Box style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Box style={{ position: 'relative' }}>
            <Code
              block
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                backgroundColor: isSent ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-green-0)',
              }}
            >
              {highlightedText}
            </Code>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              title={t('common.copy')}
              onClick={handleCopy}
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s',
                pointerEvents: isHovered ? 'auto' : 'none',
              }}
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Box>
        </Box>
      </Group>
    </Box>
  );
}

// Memoize component to prevent unnecessary re-renders
export const MessageItem = React.memo(MessageItemComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.data === nextProps.message.data &&
    prevProps.message.format === nextProps.message.format &&
    prevProps.message.type === nextProps.message.type &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.message.originalData === nextProps.message.originalData &&
    prevProps.displayFormat === nextProps.displayFormat &&
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.onResend === nextProps.onResend &&
    prevProps.currentConfig === nextProps.currentConfig
  );
});

