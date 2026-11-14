export function sriLankanWhatsAppNumber(value: string): string | null {
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const compact = value.replace(/[\s().-]/g, '');
  let national: string;
  if (compact.startsWith('+94')) national = compact.slice(3);
  else if (compact.startsWith('0094')) national = compact.slice(4);
  else if (compact.startsWith('94')) national = compact.slice(2);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else return null;
  return /^7\d{8}$/.test(national) ? `94${national}` : null;
}

export function whatsAppLink(phone: string | null, message: string): string | null {
  const number = phone ? sriLankanWhatsAppNumber(phone) : null;
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}
