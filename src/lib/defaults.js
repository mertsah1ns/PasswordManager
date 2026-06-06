/**
 * Boş vault için güvenli placeholder veriler
 * Gerçek parola içermez; yalnızca yapısal örnek.
 */

const { APP } = require('../constants');

const createPlaceholderEntry = (id, name, url) => ({
  id: String(id),
  name,
  url,
  username: '',
  password: '',
  notes: '',
  icon: '🔐',
  strength: 'medium',
  tags: [],
  category: APP.DEFAULT_CATEGORY,
  totpSecret: null,
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

const createPlaceholderCard = (id, name) => ({
  id: `c${id}`,
  name,
  brand: 'Visa',
  number: '',
  numberLast4: '****',
  holder: '',
  expiry: '',
  icon: '💳',
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

const createPlaceholderNote = (id, title) => ({
  id: `n${id}`,
  title,
  content: '',
  icon: '📝',
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

const createPlaceholderPayment = (id, name) => ({
  id: `p${id}`,
  name,
  amount: 0,
  currency: 'TRY',
  cardId: '',
  dueDay: 15,
  recurring: 'monthly',
  notes: '',
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

/** Vault okunamadığında veya yokken dönen boş vault */
function getEmptyVault() {
  return {
    entries: [],
    cards: [],
    notes: [],
    payments: [],
    nextId: 1,
    nextCardId: 1,
    nextNoteId: 1,
    nextPaymentId: 1,
  };
}

module.exports = {
  createPlaceholderEntry,
  createPlaceholderCard,
  createPlaceholderNote,
  createPlaceholderPayment,
  getEmptyVault,
};
