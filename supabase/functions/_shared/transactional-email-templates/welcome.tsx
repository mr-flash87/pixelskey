/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Pixels Key'
const SITE_URL = 'https://pixelskey.app'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Bienvenue chez {SITE_NAME} — vos licences premium à prix africains</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>
            <span style={{ color: '#ffffff' }}>Pixels</span>
            <span style={{ color: '#ffb800' }}>Key</span>
          </Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            👋 Bienvenue{name ? `, ${name}` : ''} !
          </Heading>
          <Text style={text}>
            Merci d'avoir rejoint <strong>{SITE_NAME}</strong>. Vous avez désormais
            accès à des licences premium (Windows, Office, Adobe, ChatGPT, etc.) à
            <strong> prix africains</strong>, avec livraison instantanée par email
            et WhatsApp.
          </Text>
          <Button style={button} href={SITE_URL}>
            Découvrir la boutique
          </Button>
        </Section>
        <Text style={footer}>
          Une question ? WhatsApp <strong>+226 68 88 06 72</strong>
          <br />— L'équipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Bienvenue chez Pixels Key 🎉',
  displayName: 'Email de bienvenue',
  previewData: { name: 'Awa' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 16px' }
const brand = { fontSize: '28px', fontWeight: 800 as const, margin: 0, backgroundColor: '#07070e', color: '#ffffff', padding: '14px 20px', borderRadius: '14px', display: 'inline-block' }
const card = { border: '1px solid #f0f0f4', borderRadius: '14px', padding: '24px', margin: '12px 0' }
const h1 = { fontSize: '22px', fontWeight: 800 as const, color: '#07070e', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#ff4d00', color: '#ffffff', fontSize: '14px', fontWeight: 700 as const, borderRadius: '14px', padding: '13px 22px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#55575d', textAlign: 'center' as const, margin: '20px 0' }
