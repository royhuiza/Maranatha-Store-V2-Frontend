# Maranatha — Atelier

Original Angular visual system. Keep teal #163a3e / #246263, gold #d6a15d, cream #f6f2e9. Dark surfaces #0a2023 / #142f33. Do not adopt reference-site brand palettes.

## Hierarchy
- Dashboard uses functional metrics, thin borders, large tabular numerals and whitespace.
- Hero is the atmospheric surface: procedural perspective ribbon, floating illustration, warm light.
- Forms and tables stay still while reading. Status and focus must remain clear.
- One main action per panel. Secondary actions have borders, no shadow.
- Payment recipient stays readonly; distinguish selection, payment request, and verified receipt.
- Never collect PAN/CVV without the provider's secure checkout. Never infer identity from a card number.
- DNI/RUC shows only provider-returned fields. Birthday is unavailable in current DNI API.

## Motion
- Route/panel entry 300–450ms, easing cubic-bezier(.2,.8,.2,1).
- Hover 150–250ms; no positional motion on text inputs.
- Atmospheric animation is outside Angular's change detection, capped near 30fps and device pixel ratio 1.5, stopped when hidden. Reduced motion is respected.
- No moving effects in exported receipts.

## References reviewed
- https://www.originkit.dev/components/glimmer-vale — perspective and restrained particle field. Original implementation here, no copied component code.
- https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1 — information hierarchy, fine borders.
- https://styles.refero.design/style/12255b63-e506-4bc1-a4cd-d05487de32f3 — editorial typography and warm space.
- https://spline.design/web — interaction and scene embedding capabilities. No Spline scene/account connected.

Relevant implementation: src/atelier.css, src/app/core/ambient-scene.component.ts. Existing business logic and receipt styling remain in their original files.
