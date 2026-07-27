/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  rules: {
    "alpha-value-notation": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "import-notation": "string",
    "max-nesting-depth": 2,
    "media-feature-range-notation": null,
    "no-descending-specificity": null,
    "property-no-deprecated": null,
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$",
      {
        message: "Use kebab-case classes with an optional BEM modifier"
      }
    ],
    "selector-max-id": 0,
    "selector-not-notation": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["global"]
      }
    ]
  },
  overrides: [
    {
      files: ["**/*.module.css"],
      rules: {
        "no-descending-specificity": true,
        "selector-max-specificity": "0,3,1"
      }
    }
  ]
};
