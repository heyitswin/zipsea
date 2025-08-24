module.exports = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupNumericValues: {
            floatPrecision: 1
          }
        }
      }
    },
    {
      name: 'removeViewBox',
      active: false
    }
  ]
};