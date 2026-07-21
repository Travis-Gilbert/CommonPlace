'use client';

// SOURCING: akii09/pdfx document output path on @react-pdf/renderer. Structure
// wrap: a thin Document/Page/Text shell the document block mounts when the
// produce-document pipeline is wired. No mock document bodies. ViewSource:
// package akii09/pdfx, component PdfxDocument, mode wrap, regime css-vars.

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from '@react-pdf/renderer';

// PDF output cannot consume CSS custom properties at paint time. Styles here
// are document-export constants for the renderer only; the console island that
// hosts the preview still paints with --ij-* tokens.
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 11,
    lineHeight: 1.5,
  },
  title: {
    fontSize: 18,
    marginBottom: 16,
    fontWeight: 600,
  },
  body: {
    fontSize: 11,
  },
});

export type PdfxDocumentProps = {
  readonly title: string;
  readonly body: string;
} & Pick<DocumentProps, 'author' | 'subject' | 'language'>;

export function PdfxDocument({ title, body, author, subject, language }: PdfxDocumentProps) {
  return (
    <Document author={author} subject={subject} language={language} title={title}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </Page>
    </Document>
  );
}
