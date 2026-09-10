'use strict';

var LX = typeof window !== 'undefined'
  ? (window.LX = window.LX || {})
  : (globalThis.LX = globalThis.LX || {});

(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function objectEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function uniqueKeys(...objects) {
    return [...new Set(objects.flatMap(object => Object.keys(object || {})))].sort();
  }

  LX.Util = { escapeHtml, query, queryAll, deepClone, objectEqual, uniqueKeys };
})();
