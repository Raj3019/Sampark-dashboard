import { Phone } from 'lucide-react';

function getNormalizedPhone(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().includes('nan') || trimmed.toLowerCase().includes('undefined')) return null;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) return null;

  return {
    tel: trimmed.replace(/[^\d+]/g, ''),
    whatsapp: digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly,
  };
}

function getWhatsappMessage(name: string) {
  return encodeURIComponent(`Jay Swaminarayan ${name}`);
}

export default function ContactActions({
  name,
  phoneNumber,
  size = 'sm',
}: {
  name: string;
  phoneNumber: string | null | undefined;
  size?: 'xs' | 'sm';
}) {
  const phone = getNormalizedPhone(phoneNumber);
  if (!phone) return null;

  const buttonSize = size === 'xs' ? 'h-6 w-6' : 'h-7 w-7';
  const iconSize = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const whatsappHref = `https://wa.me/${phone.whatsapp}?text=${getWhatsappMessage(name)}`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={`tel:${phone.tel}`}
        aria-label={`Call ${name}`}
        title={`Call ${name}`}
        className={`inline-flex ${buttonSize} shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200`}
      >
        <Phone className={iconSize} />
      </a>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${name}`}
        title={`WhatsApp ${name}`}
        className={`inline-flex ${buttonSize} shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={iconSize}
          fill="currentColor"
        >
          <path d="M19.05 4.94A9.94 9.94 0 0 0 12.03 2C6.55 2 2.08 6.46 2.08 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.9 9.9 0 0 0 4.79 1.22h.01c5.48 0 9.95-4.46 9.95-9.95a9.9 9.9 0 0 0-2.93-6.96ZM12.03 20.17h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.27-4.38c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.28.85 5.83 2.41a8.18 8.18 0 0 1 2.39 5.82c0 4.54-3.69 8.23-8.22 8.23Zm4.51-6.16c-.25-.13-1.47-.73-1.7-.81-.23-.09-.39-.13-.56.12-.17.26-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.42.09-.17.05-.31-.02-.43-.07-.13-.56-1.35-.77-1.84-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.43.06-.65.31-.22.26-.85.83-.85 2.02 0 1.19.87 2.35.99 2.51.12.17 1.7 2.59 4.12 3.63.57.25 1.02.4 1.37.52.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.17.21-.57.21-1.06.15-1.17-.06-.11-.22-.17-.47-.29Z" />
        </svg>
      </a>
    </span>
  );
}
