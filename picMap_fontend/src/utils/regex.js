export function isNumber(value) {
  const regex = /^-?\d+(\.\d+)?$/;
  return regex.test(value);
}