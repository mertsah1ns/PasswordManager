const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auth', {
  hasMasterPassword: () => ipcRenderer.invoke('auth:hasMasterPassword'),
  setMasterPassword: (pw) => ipcRenderer.invoke('auth:setMasterPassword', pw),
  verifyPassword: (pw) => ipcRenderer.invoke('auth:verifyPassword', pw),
  changeMasterPassword: (current, newPw) => ipcRenderer.invoke('auth:changeMasterPassword', current, newPw),
  lock: () => ipcRenderer.invoke('auth:lock'),
  isBioAvailable: () => ipcRenderer.invoke('auth:isBioAvailable'),
  getBioStatus: () => ipcRenderer.invoke('auth:getBioStatus'),
  enableBio: (pw) => ipcRenderer.invoke('auth:enableBio', pw),
  disableBio: () => ipcRenderer.invoke('auth:disableBio'),
  unlockBiometric: () => ipcRenderer.invoke('auth:unlockBiometric'),
  get2faStatus: () => ipcRenderer.invoke('auth:get2faStatus'),
  setup2fa: (pw) => ipcRenderer.invoke('auth:setup2fa', pw),
  enable2fa: (pw, secret, code) => ipcRenderer.invoke('auth:enable2fa', pw, secret, code),
  disable2fa: (pw) => ipcRenderer.invoke('auth:disable2fa', pw),
  verify2fa: (code) => ipcRenderer.invoke('auth:verify2fa', code)
});

contextBridge.exposeInMainWorld('encryption', {
  getSettings: () => ipcRenderer.invoke('encryption:getSettings'),
  applySettings: (password, iterations) => ipcRenderer.invoke('encryption:applySettings', password, iterations),
  checkPasswordBreach: (password) => ipcRenderer.invoke('encryption:checkPasswordBreach', password),
  scanEntriesBreaches: () => ipcRenderer.invoke('encryption:scanEntriesBreaches'),
  benchmarkPbdkf2: (iterationsList) => ipcRenderer.invoke('encryption:benchmarkPbdkf2', iterationsList)
});

contextBridge.exposeInMainWorld('app', {
  openPasswordCheck: () => ipcRenderer.invoke('open:passwordCheck'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onLock: (cb) => ipcRenderer.on('app:lock', cb),
  onExtensionOfferSave: (cb) => ipcRenderer.on('extension:offerSave', (_, data) => cb(data)),
  checkPaymentReminders: () => ipcRenderer.invoke('reminders:check'),
  extensionInstallHost: (id) => ipcRenderer.invoke('extension:installHost', id),
  extensionVerifyInstall: () => ipcRenderer.invoke('extension:verifyInstall'),
  extensionOpenFolder: () => ipcRenderer.invoke('extension:openExtensionFolder'),
  extensionGetPath: () => ipcRenderer.invoke('extension:getExtensionPath')
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  onMaximized: (cb) => ipcRenderer.on('window:maximized', cb),
  onUnmaximized: (cb) => ipcRenderer.on('window:unmaximized', cb)
});

contextBridge.exposeInMainWorld('vault', {
  copyToClipboard: (text, clearAfterSeconds) => ipcRenderer.invoke('copy-to-clipboard', text, clearAfterSeconds || 0),
  getEntries: () => ipcRenderer.invoke('vault:getEntries'),
  getEntry: (id) => ipcRenderer.invoke('vault:getEntry', id),
  saveEntry: (entry) => ipcRenderer.invoke('vault:saveEntry', entry),
  deleteEntry: (id) => ipcRenderer.invoke('vault:deleteEntry', id),
  getCards: () => ipcRenderer.invoke('vault:getCards'),
  saveCard: (card) => ipcRenderer.invoke('vault:saveCard', card),
  deleteCard: (id) => ipcRenderer.invoke('vault:deleteCard', id),
  getNotes: () => ipcRenderer.invoke('vault:getNotes'),
  saveNote: (note) => ipcRenderer.invoke('vault:saveNote', note),
  deleteNote: (id) => ipcRenderer.invoke('vault:deleteNote', id),
  getPayments: () => ipcRenderer.invoke('vault:getPayments'),
  savePayment: (payment) => ipcRenderer.invoke('vault:savePayment', payment),
  deletePayment: (id) => ipcRenderer.invoke('vault:deletePayment', id),
  getTotpCode: (entryId) => ipcRenderer.invoke('vault:getTotpCode', entryId),
  exportToFile: (format) => ipcRenderer.invoke('vault:exportToFile', format),
  importFromFile: () => ipcRenderer.invoke('vault:importFromFile'),
  createBackup: () => ipcRenderer.invoke('vault:createBackup'),
  getLogs: () => ipcRenderer.invoke('vault:getLogs'),
  clearLogs: () => ipcRenderer.invoke('vault:clearLogs'),
  addLog: (action, details) => ipcRenderer.invoke('vault:addLog', action, details),
  getAttachments: () => ipcRenderer.invoke('vault:getAttachments'),
  saveAttachment: () => ipcRenderer.invoke('vault:saveAttachment'),
  downloadAttachment: (fileId) => ipcRenderer.invoke('vault:downloadAttachment', fileId),
  deleteAttachment: (fileId) => ipcRenderer.invoke('vault:deleteAttachment', fileId),
  platform: process.platform
});
