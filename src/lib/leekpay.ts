// LeekPay client helpers
// IMPORTANT: All payment logic happens server-side via Edge Functions.
// No LeekPay keys are bundled with the client.
//
// The previous client-side widget integration has been replaced by
// the secure server-side flow:
//   - POST /functions/v1/create-checkout  → creates the order + LeekPay payment
//   - POST /functions/v1/leekpay-webhook  → verified server-side payment confirmation
//   - POST /functions/v1/get-order        → reads order + activation keys

export {};
