// Path: demo-page-assets/demo.ts
// This is the entry point for the demo page. It's a TypeScript file that
// loads in the module that we're buidling with this repo
import { ProofreadDom } from '../src/index'
import './style.pcss';

const proofreadDom = new ProofreadDom();
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
proofreadDom.attach(urlParams.get("url"));
