/**
 * name: proofread-transcript
 * version: v0.0.2-alpha.1
 * description: A UI component for proofreading and editing transcripts
 * author: Julian Price, inCharge Ltd
 * repository: https://github.com/incharge/proofread-transcript
 * build date: 2024-05-09T14:58:51.745Z 
 */
(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global["proofread-transcript"] = factory());
})(this, function() {
  "use strict";
  function init(message) {
    console.log(message);
    const messageOutputElement = document.getElementById("messageOutput");
    if (messageOutputElement) {
      messageOutputElement.innerHTML = message;
    }
  }
  const proofreadTranscript = {
    init
  };
  return proofreadTranscript;
});
