// src/tables/tables.controller.ts
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TablesService } from './tables.service';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  /**
   * GET /tables/qr-sheet
   * Returns an HTML page with all table QR codes ready to print.
   * Open in browser → Ctrl+P → Print or Save as PDF.
   */
  @Get('qr-sheet')
  @ApiOperation({
    summary: 'Admin — Feuille imprimable de tous les QR codes de tables',
    description:
      "Retourne une page HTML avec les QR codes de toutes les tables. Ouvrir dans le navigateur puis Ctrl+P pour imprimer ou sauvegarder en PDF.",
  })
  async getQrSheet(@Res() res: Response) {
    const html = await this.tablesService.generateQrSheetHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * GET /tables/qr-sheet/:tableId
   * Single table QR code page.
   */
  @Get('qr-sheet/:tableId')
  @ApiOperation({
    summary: 'Admin — QR code d\'une table spécifique',
  })
  async getSingleTableQr(
    @Param('tableId') tableId: string,
    @Res() res: Response,
  ) {
    const html = await this.tablesService.generateSingleTableQrHtml(tableId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}