export const CONTACTS = {
    GABRIEL: '11941197526',
    LARYSSA: '11973867114',
    SAMSUNG_GESTOR: '11976919955'
};

// Mapeamento: primeiro nome do consultor → telefone WhatsApp
export const CONSULTANT_PHONES = {
    'LUIZ': '11972182624',
    'DIOGO': '11916117591',
    'ALEXANDRE': '11943213107',
    'LIEDY': '11956871196',
    'PAULO': '11942545951',
    'MARCIO': '11973999410',
    'TATIANE': '11944726245',
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
