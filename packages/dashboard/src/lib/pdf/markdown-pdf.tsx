/**
 * Generic Markdown-to-PDF renderer for assistant messages.
 * Converts simple markdown (headings, lists, bold, paragraphs) into
 * a Japanese-formatted A4 PDF using @react-pdf/renderer.
 *
 * Lazy-loaded to keep initial bundle small.
 */
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { registerJapaneseFonts } from './base.js';

registerJapaneseFonts();

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MarkdownPdfProps {
  content: string;
  title?: string;
  companyName?: string;
  date?: string;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    padding: 40,
    paddingBottom: 60,
    color: '#1a1a1a',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '1pt solid #e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    maxWidth: '70%',
  },
  headerRight: {
    textAlign: 'right',
    fontSize: 8,
    color: '#666',
  },
  headerRightLine: {
    marginBottom: 2,
  },
  h1: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#111827',
  },
  h2: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    color: '#1f2937',
  },
  h3: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
    color: '#374151',
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    marginBottom: 6,
    color: '#1a1a1a',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 12,
  },
  bulletMarker: {
    width: 14,
    fontSize: 10,
    color: '#6b7280',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  spacer: {
    height: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '0.5pt solid #e5e7eb',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
});

/* ------------------------------------------------------------------ */
/*  Simple markdown parser                                             */
/* ------------------------------------------------------------------ */

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'paragraph' | 'spacer';
  text: string;
  marker?: string;
}

function parseMarkdownLines(content: string): ParsedLine[] {
  const lines = content.split('\n');
  const result: ParsedLine[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Empty line
    if (line.trim() === '') {
      result.push({ type: 'spacer', text: '' });
      continue;
    }

    // Headings (check ### before ## before #)
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      result.push({ type: 'h3', text: stripInlineMarkdown(h3Match[1]) });
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      result.push({ type: 'h2', text: stripInlineMarkdown(h2Match[1]) });
      continue;
    }

    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      result.push({ type: 'h1', text: stripInlineMarkdown(h1Match[1]) });
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch) {
      result.push({ type: 'bullet', text: stripInlineMarkdown(bulletMatch[1]) });
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      result.push({ type: 'numbered', text: stripInlineMarkdown(numMatch[2]), marker: `${numMatch[1]}.` });
      continue;
    }

    // Regular paragraph
    result.push({ type: 'paragraph', text: stripInlineMarkdown(line) });
  }

  return result;
}

/** Strip bold markers and other inline markdown for plain text rendering. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
}

/** Extract the first heading from content to use as a default title. */
function extractTitle(content: string): string {
  const match = content.match(/^#{1,3}\s+(.+)/m);
  if (match) return stripInlineMarkdown(match[1]);
  return 'おしごと AIレポート';
}

/* ------------------------------------------------------------------ */
/*  PDF Document component                                             */
/* ------------------------------------------------------------------ */

function MarkdownPdfDocument({ content, title, companyName, date }: MarkdownPdfProps) {
  const resolvedTitle = title || extractTitle(content);
  const resolvedDate = date || new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const parsed = parseMarkdownLines(content);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{resolvedTitle}</Text>
          <View style={styles.headerRight}>
            {companyName && (
              <Text style={styles.headerRightLine}>{companyName}</Text>
            )}
            <Text style={styles.headerRightLine}>{resolvedDate}</Text>
          </View>
        </View>

        {/* Body */}
        {parsed.map((line, i) => {
          switch (line.type) {
            case 'h1':
              return <Text key={i} style={styles.h1}>{line.text}</Text>;
            case 'h2':
              return <Text key={i} style={styles.h2}>{line.text}</Text>;
            case 'h3':
              return <Text key={i} style={styles.h3}>{line.text}</Text>;
            case 'bullet':
              return (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletMarker}>・</Text>
                  <Text style={styles.bulletText}>{line.text}</Text>
                </View>
              );
            case 'numbered':
              return (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletMarker}>{line.marker}</Text>
                  <Text style={styles.bulletText}>{line.text}</Text>
                </View>
              );
            case 'spacer':
              return <View key={i} style={styles.spacer} />;
            case 'paragraph':
            default:
              return <Text key={i} style={styles.paragraph}>{line.text}</Text>;
          }
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>FujiTrace おしごと AI</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a PDF blob from markdown content.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer
 * in the initial bundle.
 */
export async function generateMarkdownPdf(
  content: string,
  options?: { title?: string; companyName?: string; date?: string },
): Promise<Blob> {
  const doc = (
    <MarkdownPdfDocument
      content={content}
      title={options?.title}
      companyName={options?.companyName}
      date={options?.date}
    />
  );
  return await pdf(doc).toBlob();
}
