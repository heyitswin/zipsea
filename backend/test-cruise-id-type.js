const cruiseIds = "{2260845,2260844,2260842}";
const cleaned = cruiseIds.replace(/^\{|\}$/g, '');
const ids = cleaned.split(',');
console.log('First ID:', ids[0]);
console.log('Type:', typeof ids[0]);
console.log('String():', String(ids[0]));
console.log('Trimmed:', String(ids[0]).trim());
