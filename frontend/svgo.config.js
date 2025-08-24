module.exports = {
  plugins: [
    // Use default preset but disable specific plugins
    {
      name: 'preset-default'
    },
    // Explicitly disable removeXMLNS to preserve xmlns attribute
    {
      name: 'removeXMLNS',
      active: false
    },
    // Disable removeViewBox to preserve viewBox attribute
    {
      name: 'removeViewBox',
      active: false
    },
    // Apply float precision to path coordinates - configure directly
    {
      name: 'cleanupNumericValues',
      params: {
        floatPrecision: 1,
        leadingZero: true,
        defaultPx: true,
        convertToPx: true
      }
    }
  ]
};