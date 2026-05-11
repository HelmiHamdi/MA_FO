// src/tables/tables.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a printable HTML page with one QR card per table.
   * Each QR code encodes the table's qrToken (the same value
   * that confirmTableQr() expects).
   */
  async generateQrSheetHtml(): Promise<string> {
    const tables = await this.prisma.table.findMany({
      orderBy: [{ room: 'asc' }, { number: 'asc' }],
    });

    if (tables.length === 0) {
      return '<html><body><p>Aucune table en base de données.</p></body></html>';
    }

    const cards = await Promise.all(
      tables.map(async (table) => {
        const svg = await QRCode.toString(table.qrToken, {
          type: 'svg',
          width: 220,
          margin: 1,
          color: { dark: '#1a0533', light: '#ffffff' },
        });
        return this.buildCard(table, svg);
      }),
    );

    return this.buildPage(cards, 'Toutes les tables — QR Codes');
  }

  async generateSingleTableQrHtml(tableId: string): Promise<string> {
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table introuvable');

    const svg = await QRCode.toString(table.qrToken, {
      type: 'svg',
      width: 280,
      margin: 1,
      color: { dark: '#1a0533', light: '#ffffff' },
    });

    return this.buildPage([this.buildCard(table, svg)], `Table ${table.number} — QR Code`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildCard(table: any, svgString: string): string {
    return `
      <div class="card">
        <div class="card-header">
          <div class="table-number">Table ${table.number}</div>
          <div class="table-room">${table.room ?? ''}</div>
        </div>
        <div class="qr-wrapper">${svgString}</div>
        <div class="token-hint">Token : ${table.qrToken.slice(0, 8)}…</div>
      </div>`;
  }

  private buildPage(cards: string[], title: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8f7ff;
      color: #1e1b4b;
      padding: 2rem;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #4c1d95;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: #ffffff;
      border: 2px solid #ede9fe;
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 2px 12px rgba(109,40,217,0.08);
      break-inside: avoid;
    }

    .card-header { text-align: center; }

    .table-number {
      font-size: 1.25rem;
      font-weight: 800;
      color: #4c1d95;
      line-height: 1;
    }
    .table-room {
      font-size: 0.8rem;
      font-weight: 600;
      color: #7c3aed;
      margin-top: 4px;
      background: #ede9fe;
      padding: 2px 10px;
      border-radius: 20px;
      display: inline-block;
    }

    .qr-wrapper {
      background: #fff;
      border-radius: 12px;
      padding: 8px;
      border: 1.5px solid #ddd6fe;
    }
    .qr-wrapper svg { display: block; }

    .token-hint {
      font-size: 0.62rem;
      color: #9ca3af;
      font-family: monospace;
      letter-spacing: 0.04em;
    }

    /* Print styles */
    @media print {
      body { background: #fff; padding: 1cm; }
      h1, .subtitle { color: #000; }
      .card { border: 1px solid #ccc; box-shadow: none; }
      .table-room { background: #eee; color: #333; }
    }
  </style>
</head>
<body>
  <h1>📋 ${title}</h1>
  <p class="subtitle">
    Imprimez cette page et placez chaque QR code sur la table correspondante.
    Utilisez Ctrl+P (ou ⌘+P sur Mac) pour imprimer.
  </p>
  <div class="grid">
    ${cards.join('\n')}
  </div>
</body>
</html>`;
  }
}