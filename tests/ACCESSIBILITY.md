# Weather dashboard manual QA checklist

Run `npm test` for the automated utility tests. Also verify the actual page in a browser before release:

- At 320px, 375px, and tablet widths, confirm there is no horizontal page scrolling and forecast cards remain readable.
- Use only the keyboard: Tab through social links, city search, unit selector, location button, matching-location choices, and contact form. Confirm visible focus and that Enter/Space activate controls.
- With a screen reader, confirm loading/success/error messages are announced from the weather status region and matching locations have clear names.
- Search a common city with multiple matches, select each result, and confirm the forecast uses the chosen location.
- Load a forecast, then change city/unit while offline or with a failed request; confirm the last successful forecast remains visible and the error is announced.
- Try rapid repeat submissions and confirm controls are disabled until the current request completes.

Automated unit tests cover weather-code labels, temperature formatting and unit-specific request parameters, ambiguous-city result normalization, city query encoding, and successful/failed API requests. They do not replace browser, keyboard, screen-reader, or real-device checks.
