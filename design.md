---
version: alpha
name: Hallmark Editorial
description: A minimalist, high-contrast editorial system with a warm paper base, crisp ink text, and a single vivid orange accent.
colors:
  primary: "#0f0f0e"
  secondary: "#8e8e88"
  tertiary: "#fc4c02"
  neutral: "#fafaf9"
  surface: "#ffffff"
  on-surface: "#0f0f0e"
  error: "#c0392b"
  border: "#e5e2dc"
typography:
  headline-display:
    fontFamily: Newsreader
    fontSize: 88px
    fontWeight: 400
    lineHeight: 106px
    letterSpacing: "-3.08px"
  headline-xl:
    fontFamily: Newsreader
    fontSize: 61px
    fontWeight: 400
    lineHeight: 73px
    letterSpacing: "-1.35px"
  headline-lg:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: 400
    lineHeight: 58px
    letterSpacing: "-1.0px"
  headline-md:
    fontFamily: Geist
    fontSize: 42px
    fontWeight: 400
    lineHeight: 50px
    letterSpacing: "-0.17px"
  headline-sm:
    fontFamily: Geist
    fontSize: 29px
    fontWeight: 400
    lineHeight: 35px
    letterSpacing: "0px"
  body-lg:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: 400
    lineHeight: 31px
    letterSpacing: "0px"
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0px"
  body-sm:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "0px"
  label-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0px"
  label-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "0px"
  label-sm:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: "0px"
  code-md:
    fontFamily: Geist Mono
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "0px"
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 17px
  xl: 24px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 36px
  lg: 64px
  xl: 128px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 41px
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 41px
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 0px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 3px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 8px 16px
  chip:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  code-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.code-md}"
    rounded: "{rounded.full}"
    padding: 8px 12px
---

# Hallmark Editorial

## Overview
Hallmark feels like a refined editorial landing page for a design-savvy, developer-adjacent audience. The tone is confident and slightly playful, with a premium magazine-like serif hero balanced by restrained system-like UI chrome. Overall density is low: generous white space, centered composition, and a few carefully staged elements create a calm, high-trust first impression.

## Colors
- **Primary (#0f0f0e):** A near-black ink used for headlines, body text, and the strongest UI elements. It gives the page its sharp editorial contrast.
- **Secondary (#8e8e88):** A muted warm gray used for supporting copy and low-emphasis UI text. It keeps the interface quiet without feeling cold.
- **Tertiary (#fc4c02):** A vivid orange accent used sparingly for brand marks, command prompts, and emphasis. It adds energy and a handcrafted, slightly irreverent feel.
- **Neutral (#fafaf9):** The soft paper-like page background. It reads warmer than pure white and supports the printed-editorial atmosphere.
- **Surface (#ffffff):** Pure white for elevated panels and internal card surfaces where separation from the paper base is needed.
- **On-surface (#0f0f0e):** The default text color on light surfaces, matching the primary ink tone for clarity and consistency.
- **Error (#c0392b):** A restrained red reserved for destructive or invalid states. It should stay rare so the orange accent remains dominant.
- **Border (#e5e2dc):** A faint warm divider color for subtle outlines, chips, and thin container edges.

## Typography
The type system is intentionally split between an expressive serif and a pragmatic sans. Newsreader drives the largest headlines with a dramatic, editorial presence, while Geist handles all body, labels, and interface text with a clean, modern rhythm. Geist Mono is reserved for command-line strings and code-like snippets to reinforce the product’s developer context.

Headlines should feel elegant and slightly theatrical: large sizes, light weight, and tight negative tracking. The display treatment is especially visible in `headline-display` and `headline-xl`, which are used for the main hero statement. Secondary headers can switch to Geist for a more product-oriented tone, as reflected in `headline-md` and `headline-sm`.

Body text is comfortable and fairly large, with generous line height for a spacious feel. Labels stay neutral and unadorned, with no visible uppercase styling or heavy letter-spacing in the source. Code and installation snippets should use `code-md` for a monospace, terminal-like look.

## Layout
The composition is centered and highly controlled, with a strong vertical stack: brand mark, hero, subcopy, CTA, and a row of preview cards. Spacing follows a clear modular rhythm based on the extracted scale of `8px`, `16px`, `36px`, `64px`, and `128px`, which creates noticeable breathing room between major sections. Use larger gaps between hero groups and smaller gaps within controls and compact UI clusters.

The page behaves like a spacious landing surface rather than a dense app shell. Content blocks should stay relatively narrow and centered, while supplementary visuals can span wider but remain lightly framed. Cards and panels should use modest internal padding and ample outer margins so the layout retains its airy, premium feel.

## Elevation & Depth
Depth is subtle and mostly achieved through soft shadows, thin outlines, and layered tonal contrast rather than heavy elevation. The base page is flat and bright, while cards gain separation through soft drop shadows and a faint edge treatment. This is a restrained system: hierarchy should come from scale, contrast, and whitespace before shadow.

Use shadows sparingly and keep them blurred and diffuse. Interactive or preview surfaces may sit above the background with a warm, natural-looking cast, but avoid glossy, neumorphic, or overly dimensional effects. The result should feel like printed mockups arranged on a tabletop rather than floating app chrome.

## Shapes
The shape language is soft and rounded, especially for pills, buttons, and container cards. Interactive elements lean into full or near-full pill radii, while larger panels use a gentle medium radius around 17px. This keeps the system approachable and tactile without losing its editorial restraint.

Avoid sharp geometry unless a component is explicitly code-like or structural. Even cards should feel softly cut rather than rigidly boxed, and corner treatment should remain consistent across similar surface types.

## Components
Buttons are pill-shaped and compact. `button-primary` uses the near-black primary background with neutral text and the full radius treatment, making it the strongest call to action. `button-secondary` is outlined/transparent with primary text and border, suitable for alternate actions. `button-tertiary` should remain text-only and understated, using the secondary color and no container chrome. Button sizing should stay close to the extracted 41px height and 8px 16px padding for consistency.

Cards use a light surface, subtle rounding, and a restrained shadow. The `card` token is best for framed previews and content panels that need clear separation without visual noise. Keep internal padding minimal where the card is mostly a showcase shell, and let content spacing do the rest.

Inputs and command fields should feel like calm pills rather than boxed form controls. Use the full rounded treatment, thin borders, and comfortable horizontal padding. The installation command is a good reference: it combines monospace text, a light surface, and a low-emphasis icon cluster.

Chips and badges should be small, rounded, and low-contrast. They can be used for status labels, product tags, or compact meta information. Keep them visually subordinate to hero text and primary actions.

Code-like snippets should use monospace typography and can sit inside subtle rounded pills, as in `code-pill`. The accent orange is appropriate for shell prompts or leading symbols, but the remainder of the string should stay neutral and highly legible.

## Do's and Don'ts
- Do keep hero headlines serif-led, large, and tightly tracked.
- Do use the orange accent sparingly for emphasis, prompts, and brand marks.
- Do preserve the warm paper background instead of switching to a pure white canvas everywhere.
- Do favor whitespace and scale for hierarchy before adding stronger shadows.
- Don't introduce saturated secondary colors that compete with the orange accent.
- Don't use hard corners on major controls or surface cards.
- Don't make body text too small or too dense; the system depends on easy breathing room.
- Don't over-style buttons with gradients, glossy fills, or heavy borders.
