export const CONTACTS = {
    GABRIEL: '11941197526',
    ANDRE: '11973562750'
};

export const createWhatsAppLink = (number, text) => {
    const encodedText = encodeURIComponent(text);

    if (!number) {
        // This opens WhatsApp share/select screen
        return `https://wa.me/?text=${encodedText}`;
    }

    // Ensure number has country code if needed, but here assuming 55 is needed for BR
    const cleanNumber = number.replace(/\D/g, '');
    const finalNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

    return `https://wa.me/${finalNumber}?text=${encodedText}`;
};
