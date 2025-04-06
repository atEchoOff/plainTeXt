// See https://www.npmjs.com/package/prosemirror-image-plugin for setup and more info

const { extraAttributes } = imagePluginSettings;
  const attributesUpdate = Object.keys(extraAttributes)
    .map((attrKey) => ({
      [attrKey]: {
        default: extraAttributes[attrKey] || null,
      },
    }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const attributeKeys = [...Object.keys(extraAttributes), "src", "alt"];

const imageSpec = {
    ...(imagePluginSettings.hasTitle ? { content: "inline*" } : {}),
    attrs: {
      src: { default: null },
      alt: { default: null },
      height: { default: null },
      width: { default: null },
      maxWidth: { default: null },
      ...attributesUpdate,
    },
    atom: true,
    ...(imagePluginSettings.isBlock
      ? { group: "block" }
      : { group: "inline", inline: true }),
    draggable: false,
    toDOM(node) {
      const toAttributes = attributeKeys
        .map((attrKey) => ({ [`imageplugin-${attrKey}`]: node.attrs[attrKey] }))
        // merge
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
      return [
        "div",
        {
          class: `imagePluginRoot`,
          ...toAttributes,
        },
        ...(imagePluginSettings.hasTitle ? [0] : []),
      ];
    },
    parseDOM: [
      {
        tag: "div.imagePluginRoot",
        getAttrs(dom) {
          if (typeof dom === "string") return {};
          return (
            attributeKeys
              .map((attrKey) => ({
                [attrKey]: dom.getAttribute(`imageplugin-${attrKey}`),
              }))
              // merge
              .reduce((acc, curr) => ({ ...acc, ...curr }), {})
          );
        }
    }
]
}