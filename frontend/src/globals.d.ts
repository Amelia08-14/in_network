// Migration TypeScript 6/7 (cf. brief §0) : TS 6+ exige une déclaration de
// module explicite pour un import CSS "effet de bord" (import './globals.css'
// dans app/layout.tsx) — Next.js 14 ne l'expose pas encore lui-même de façon
// compatible avec cette nouvelle règle (TS2882). Reste correct et sans effet
// une fois Next.js mis à niveau.
declare module '*.css';
