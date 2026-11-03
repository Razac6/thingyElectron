import React, { useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CodeLanguage,
  codeColors,
  highlightCode,
  MONO_FONT,
} from './highlight';

// A plain <textarea> with syntax highlighting: the highlighted copy of the text sits in a
// <pre> right behind it (same font, padding and scroll position) and the textarea's own
// text is transparent, so you see the colours but edit a normal, fast textarea - undo,
// selection, IME and spellcheck-off all work as usual. Tab inserts two spaces.

const PAD = 12;
const LINE_HEIGHT = 1.55;

export default function CodeArea({
  value,
  onChange,
  language,
  placeholder,
  readOnly,
  errorLine,
  minHeight = 160,
  ariaLabel,
}: {
  value: string;
  onChange?: (value: string) => void;
  language: CodeLanguage;
  placeholder?: string;
  readOnly?: boolean;
  errorLine?: number;
  minHeight?: number | string;
  ariaLabel?: string;
}) {
  const theme = useTheme();
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const html = useMemo(
    // A trailing newline needs a character after it or the last line has no height
    () => `${highlightCode(value, language)}\n `,
    [value, language],
  );
  const lineCount = value.split('\n').length;

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || readOnly || !onChange) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = start + 2;
      el.selectionEnd = start + 2;
    });
  };

  const font = {
    fontFamily: MONO_FONT,
    fontSize: '0.8125rem',
    lineHeight: LINE_HEIGHT,
    tabSize: 2,
    letterSpacing: 0,
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        height: '100%',
        minHeight,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.text.primary, 0.025),
        overflow: 'hidden',
        '&:focus-within': { borderColor: 'text.secondary' },
      }}
    >
      {/* Line numbers */}
      <Box
        ref={gutterRef}
        aria-hidden
        sx={{
          ...font,
          flexShrink: 0,
          overflow: 'hidden',
          py: `${PAD}px`,
          px: 1,
          minWidth: 36,
          textAlign: 'right',
          color: 'text.disabled',
          borderRight: 1,
          borderColor: 'divider',
          userSelect: 'none',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <Box
            key={i}
            sx={
              errorLine === i + 1
                ? { color: 'error.main', fontWeight: 700 }
                : undefined
            }
          >
            {i + 1}
          </Box>
        ))}
      </Box>

      <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <Box
          component="pre"
          ref={preRef}
          aria-hidden
          sx={{
            ...font,
            ...codeColors(theme),
            position: 'absolute',
            inset: 0,
            m: 0,
            p: `${PAD}px`,
            overflow: 'hidden',
            whiteSpace: 'pre',
            color: 'text.primary',
            pointerEvents: 'none',
          }}
          // highlight.js output is HTML-escaped
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Box
          component="textarea"
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          aria-label={ariaLabel}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange?.(e.target.value)
          }
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          sx={{
            ...font,
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            m: 0,
            p: `${PAD}px`,
            border: 0,
            outline: 0,
            resize: 'none',
            whiteSpace: 'pre',
            overflow: 'auto',
            bgcolor: 'transparent',
            color: 'transparent',
            caretColor: theme.palette.text.primary,
            '&::placeholder': { color: 'text.disabled' },
            '&::selection': {
              bgcolor: alpha(theme.palette.primary.main, 0.25),
              color: 'transparent',
            },
          }}
        />
      </Box>
    </Box>
  );
}

CodeArea.defaultProps = {
  onChange: undefined,
  placeholder: undefined,
  readOnly: false,
  errorLine: undefined,
  minHeight: 160,
  ariaLabel: undefined,
};
