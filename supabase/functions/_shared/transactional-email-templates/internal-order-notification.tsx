/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item { name: string; quantity: number; unit_price: number; duration?: string }
interface Props {
  reference: string
  total: number
  customer_email: string
  customer_name?: string
  customer_phone?: string
  items: Item[]
  order_url: string
  payment_provider?: string
}

const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`

const InternalOrderNotification = ({
  reference, total, customer_email, customer_name, customer_phone,
  items = [], order_url, payment_provider,
}: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Nouveau paiement reçu — {reference} ({fmt(total)})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={banner}>
          <Text style={bannerLabel}>💰 NOUVEAU PAIEMENT</Text>
          <Heading style={h1}>{reference}</Heading>
          <Text style={amount}>{fmt(total)}</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Client</Heading>
          <Text style={kv}><strong>Email :</strong> {customer_email}</Text>
          {customer_name && <Text style={kv}><strong>Nom :</strong> {customer_name}</Text>}
          {customer_phone && <Text style={kv}><strong>Téléphone :</strong> {customer_phone}</Text>}
          {payment_provider && <Text style={kv}><strong>Méthode :</strong> {payment_provider}</Text>}
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Récapitulatif</Heading>
          {items.map((it, i) => (
            <div key={i} style={itemRow}>
              <Text style={itemName}>
                {it.quantity} × {it.name}
                {it.duration ? ` (${it.duration})` : ''}
              </Text>
              <Text style={itemPrice}>{fmt(it.unit_price * it.quantity)}</Text>
            </div>
          ))}
          <Hr style={hr} />
          <div style={itemRow}>
            <Text style={totalLabel}>TOTAL</Text>
            <Text style={totalValue}>{fmt(total)}</Text>
          </div>
        </Section>

        <Section style={{ textAlign: 'center', padding: '20px 0' }}>
          <a href={order_url} style={btn}>Ouvrir la commande</a>
        </Section>

        <Text style={footer}>Notification automatique — Pixels Key Admin</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InternalOrderNotification,
  subject: (d: Record<string, any>) =>
    `💰 Nouveau paiement ${d.reference ?? ''} — ${(d.total ?? 0).toLocaleString('fr-FR')} FCFA`,
  displayName: 'Notification interne — paiement reçu',
  to: Deno.env.get('ADMIN_NOTIFICATION_EMAIL') ?? 'cesarapplestore@gmail.com',
  previewData: {
    reference: 'PK-ABC12345',
    total: 15000,
    customer_email: 'client@example.com',
    customer_name: 'Jean Kouassi',
    customer_phone: '+22612345678',
    items: [{ name: 'Netflix Premium', quantity: 1, unit_price: 15000, duration: '1 mois' }],
    order_url: 'https://pixelskey.app/order/abc',
    payment_provider: 'LeekPay',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px' }
const banner = {
  background: 'linear-gradient(135deg, #ff4d00 0%, #ffb800 100%)',
  borderRadius: '12px', padding: '24px', textAlign: 'center' as const, color: '#ffffff',
}
const bannerLabel = { fontSize: '12px', letterSpacing: '2px', margin: 0, opacity: 0.9, color: '#ffffff' }
const h1 = { fontSize: '20px', margin: '8px 0 4px', color: '#ffffff' }
const amount = { fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#ffffff' }
const card = { backgroundColor: '#fafafa', borderRadius: '12px', padding: '20px', marginTop: '16px', border: '1px solid #eee' }
const h2 = { fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '1px', color: '#ff4d00', margin: '0 0 12px' }
const kv = { fontSize: '14px', color: '#222', margin: '4px 0' }
const itemRow = { display: 'flex', justifyContent: 'space-between', padding: '6px 0' }
const itemName = { fontSize: '14px', color: '#222', margin: 0 }
const itemPrice = { fontSize: '14px', color: '#222', margin: 0, fontWeight: 600 }
const hr = { borderColor: '#e5e5e5', margin: '12px 0' }
const totalLabel = { fontSize: '14px', fontWeight: 'bold', color: '#000', margin: 0 }
const totalValue = { fontSize: '16px', fontWeight: 'bold', color: '#ff4d00', margin: 0 }
const btn = {
  display: 'inline-block', backgroundColor: '#ff4d00', color: '#ffffff',
  padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600,
}
const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const, marginTop: '24px' }
