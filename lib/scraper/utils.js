function fillTemplate(template, vars) {
  return template.replace(/\{(.*?)\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing value for template key {${key}}`);
    }
    return encodeURIComponent(String(value));
  });
}

function extractPrice(text, regex) {
  const normalised = text.replace(/\s+/g, ' ').trim();
  if (!regex) {
    return parseFloat(normalised.replace(/[^0-9.,]/g, '').replace(',', '.'));
  }
  const re = new RegExp(regex);
  const match = normalised.match(re);
  if (!match) {
    throw new Error(`No price match in "${normalised}"`);
  }
  const raw = match[1] || match[0];
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
}

module.exports = {
  fillTemplate,
  extractPrice
};
