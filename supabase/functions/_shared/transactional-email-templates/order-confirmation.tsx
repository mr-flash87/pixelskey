/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Pixels Key'
const SITE_URL = 'https://pixelskey.app'

interface OrderItem {
  name: string
  quantity: number
  unit_price: number
  duration?: string
}
interface LicenseKey {
  product_name: string
  license_key: string
}
interface OrderConfirmationProps {
  customer_name?: string
  reference: string
  total: number
  items: OrderItem[]
  license_keys?: LicenseKey[]
  order_url: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'

const OrderConfirmationEmail = ({
  customer_name,
  reference,
  total,
  items = [],
  license_keys = [],
  order_url,
}: OrderConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Commande {reference} confirmée — Vos clés sont prêtes 🎁</Preview>
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
            🎉 Merci{customer_name ? `, ${customer_name}` : ''} !
          </Heading>
          <Text style={text}>
            Votre commande <strong>{reference}</strong> a bien été confirmée.
            Voici le récapitulatif et vos clés d'activation.
          </Text>

          <Button style={button} href={order_url}>
            Voir ma commande
          </Button>
        </Section>

        {license_keys.length > 0 && (
          <Section style={keysBox}>
            <Text style={keysTitle}>🔑 Vos clés d'activation</Text>
            {license_keys.map((k, i) => (
              <Section key={i} style={keyItem}>
                <Text style={keyName}>{k.product_name}</Text>
                <Text style={keyValue}>{k.license_key}</Text>
              </Section>
            ))}
            <Text style={smallNote}>
              💡 Conservez ces clés en lieu sûr. Elles ne seront pas renvoyées.
            </Text>
          </Section>
        )}

        <Section style={card}>
          <Text style={sectionTitle}>Détail de la commande</Text>
          {items.map((it, i) => (
            <Row key={i} style={itemRow}>
              <Column>
                <Text style={itemName}>{it.name}</Text>
                <Text style={itemMeta}>
                  {it.duration ? `${it.duration} · ` : ''}× {it.quantity}
                </Text>
              </Column>
              <Column align="right">
                <Text style={itemPrice}>{fmt(it.unit_price * it.quantity)}</Text>
              </Column>
            </Row>
          ))}
          <Hr style={hr} />
          <Row>
            <Column>
              <Text style={totalLabel}>Total payé</Text>
            </Column>
            <Column align="right">
              <Text style={totalValue}>{fmt(total)}</Text>
            </Column>
          </Row>
        </Section>

        <Text style={footer}>
          Besoin d'aide ? Contactez-nous sur WhatsApp au{' '}
          <strong>+226 68 88 06 72</strong>.
          <br />— L'équipe {SITE_NAME}
        </Text>
        <Text style={footerSmall}>
          {SITE_NAME} · {SITE_URL}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Commande ${data.reference ?? ''} confirmée — Pixels Key 🎁`,
  displayName: 'Confirmation de commande',
  previewData: {
    customer_name: 'Awa',
    reference: 'PK-A1B2C3D4',
    total: 12500,
    items: [
      { name: 'Windows 11 Pro', quantity: 1, unit_price: 7500, duration: 'À vie' },
      { name: 'ChatGPT Plus', quantity: 1, unit_price: 5000, duration: '1 mois' },
    ],
    license_keys: [
      { product_name: 'Windows 11 Pro', license_key: 'XXXXX-YYYYY-ZZZZZ-AAAAA-BBBBB' },
      { product_name: 'ChatGPT Plus', license_key: 'chatgpt-acct-123@pixelskey.app' },
    ],
    order_url: 'https://pixelskey.app/order/example',
  },
} satisfies TemplateEntry

// ─── Styles ───
const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 16px' }
const brand = { fontSize: '28px', fontWeight: 800 as const, margin: 0, letterSpacing: '-0.02em', backgroundColor: '#07070e', color: '#ffffff', padding: '14px 20px', borderRadius: '14px', display: 'inline-block' }
const card = { backgroundColor: '#ffffff', border: '1px solid #f0f0f4', borderRadius: '14px', padding: '24px', margin: '12px 0' }
const h1 = { fontSize: '22px', fontWeight: 800 as const, color: '#07070e', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 18px' }
const button = { backgroundColor: '#ff4d00', color: '#ffffff', fontSize: '14px', fontWeight: 700 as const, borderRadius: '14px', padding: '13px 22px', textDecoration: 'none', display: 'inline-block' }
const sectionTitle = { fontSize: '13px', fontWeight: 700 as const, color: '#07070e', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 12px' }
const itemRow = { borderBottom: '1px solid #f0f0f4', padding: '8px 0' }
const itemName = { fontSize: '14px', fontWeight: 600 as const, color: '#07070e', margin: 0 }
const itemMeta = { fontSize: '12px', color: '#999', margin: '2px 0 0' }
const itemPrice = { fontSize: '14px', fontWeight: 700 as const, color: '#ff4d00', margin: 0 }
const hr = { border: 'none', borderTop: '1px solid #f0f0f4', margin: '14px 0' }
const totalLabel = { fontSize: '13px', color: '#55575d', margin: 0 }
const totalValue = { fontSize: '20px', fontWeight: 800 as const, color: '#ff4d00', margin: 0 }
const keysBox = { background: 'linear-gradient(135deg, #fff7eb 0%, #ffeed1 100%)', border: '2px solid #ffb800', borderRadius: '14px', padding: '20px', margin: '12px 0' }
const keysTitle = { fontSize: '15px', fontWeight: 800 as const, color: '#07070e', margin: '0 0 12px' }
const keyItem = { backgroundColor: '#ffffff', border: '1px solid #ffb800', borderRadius: '10px', padding: '10px 12px', margin: '0 0 8px' }
const keyName = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, margin: '0 0 4px', letterSpacing: '0.05em' }
const keyValue = { fontFamily: 'Courier, monospace', fontSize: '14px', fontWeight: 700 as const, color: '#07070e', margin: 0, wordBreak: 'break-all' as const }
const smallNote = { fontSize: '12px', color: '#7a5a00', margin: '12px 0 0', fontStyle: 'italic' as const }
const footer = { fontSize: '13px', color: '#55575d', textAlign: 'center' as const, margin: '20px 0 6px', lineHeight: '1.6' }
const footerSmall = { fontSize: '11px', color: '#999', textAlign: 'center' as const, margin: '0' }
