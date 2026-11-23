/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customer_name?: string
  reference: string
  order_url: string
}

const ActivationReminder = ({ customer_name, reference, order_url }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Vos clés Pixels Key vous attendent 🔑</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={hero}>
          <Text style={emoji}>🔑</Text>
          <Heading style={h1}>
            {customer_name ? `${customer_name}, ` : ''}vos clés vous attendent !
          </Heading>
        </Section>

        <Section style={card}>
          <Text style={text}>
            Nous avons remarqué que vous n'avez pas encore récupéré les clés
            de votre commande <strong>{reference}</strong> passée hier.
          </Text>
          <Text style={text}>
            Vos clés sont prêtes et disponibles 24h/24. Cliquez sur le bouton
            ci-dessous pour les afficher en toute sécurité :
          </Text>

          <div style={{ textAlign: 'center', margin: '28px 0' }}>
            <a href={order_url} style={btn}>Voir mes clés maintenant</a>
          </div>

          <Text style={small}>
            Vous pouvez aussi copier ce lien dans votre navigateur :<br />
            <a href={order_url} style={linkStyle}>{order_url}</a>
          </Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Besoin d'aide ?</Heading>
          <Text style={text}>
            Notre équipe est disponible 7j/7 sur WhatsApp au{' '}
            <a href="https://wa.me/22668880672" style={linkStyle}>+226 68 88 06 72</a>
            {' '}pour vous accompagner dans l'activation.
          </Text>
        </Section>

        <Text style={footer}>Pixels Key — Votre boutique premium</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ActivationReminder,
  subject: (d: Record<string, any>) =>
    `🔑 ${d.customer_name ? d.customer_name + ', vos' : 'Vos'} clés Pixels Key vous attendent`,
  displayName: 'Rappel d\'activation 24h',
  previewData: {
    customer_name: 'Jean',
    reference: 'PK-ABC12345',
    order_url: 'https://pixelskey.app/order/abc',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px' }
const hero = { textAlign: 'center' as const, padding: '24px 0' }
const emoji = { fontSize: '48px', margin: 0 }
const h1 = { fontSize: '24px', color: '#0f0f1a', margin: '8px 0' }
const h2 = { fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '1px', color: '#ff4d00', margin: '0 0 12px' }
const card = { backgroundColor: '#fafafa', borderRadius: '12px', padding: '24px', marginTop: '16px', border: '1px solid #eee' }
const text = { fontSize: '15px', color: '#333', lineHeight: 1.6, margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#888', lineHeight: 1.6, margin: '12px 0 0', wordBreak: 'break-all' as const }
const linkStyle = { color: '#ff4d00', textDecoration: 'none' }
const btn = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #ff4d00 0%, #ffb800 100%)',
  color: '#ffffff', padding: '14px 32px', borderRadius: '10px',
  textDecoration: 'none', fontWeight: 700, fontSize: '15px',
}
const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const, marginTop: '24px' }
