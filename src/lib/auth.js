/**
 * Auth yükleme, kaydetme
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { FILES } = require('../constants');

const userDataPath = app.getPath('userData');
const authPath = path.join(userDataPath, FILES.AUTH);

function loadAuth() {
  try {
    const data = fs.readFileSync(authPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2), 'utf8');
}

module.exports = {
  authPath,
  loadAuth,
  saveAuth,
};
