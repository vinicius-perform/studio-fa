// src/services/image/subject-segmentation.service.ts
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export interface SubjectCutoutResult {
  cutoutBuffer: Buffer;
  cutoutDataUrl: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  transparentPixelRatio: number;
}

export class SubjectSegmentationService {
  /**
   * Remove o fundo da foto do objeto principal localmente e deterministicamente,
   * produzindo um PNG com canal alpha real contendo apenas a pessoa/objeto recortado.
   *
   * Utiliza um worker em processo isolado para garantir total segurança de memória
   * e evitar conflitos entre bibliotecas C++ nativas no ambiente Windows.
   */
  public static async removeBackground(imageBuffer: Buffer): Promise<SubjectCutoutResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Não foi possível separar a pessoa do fundo: buffer de imagem vazio.');
    }

    const tmpDir = os.tmpdir();
    const tempId = `bg_rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = path.join(tmpDir, `${tempId}_in.png`);
    const outputPath = path.join(tmpDir, `${tempId}_out.png`);

    try {
      // 1. Sanitiza a imagem de entrada e salva em arquivo temporário como PNG
      const sanitizedPng = await sharp(imageBuffer).png().toBuffer();
      fs.writeFileSync(inputPath, sanitizedPng);

      // 2. Localiza o worker CJS isolado
      const workerScriptPath = path.resolve(process.cwd(), 'scripts', 'remove-bg-worker.cjs');
      if (!fs.existsSync(workerScriptPath)) {
        throw new Error(`Worker de remoção de fundo não encontrado em: ${workerScriptPath}`);
      }

      // 3. Executa o worker em processo filho totalmente isolado
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(process.execPath, [workerScriptPath, inputPath, outputPath], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';
        proc.stderr?.on('data', (d) => {
          stderr += d.toString();
        });

        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve();
          } else {
            reject(new Error(stderr || `Worker finalizou com código ${code}`));
          }
        });

        proc.on('error', (err) => {
          reject(err);
        });
      });

      // 4. Lê o PNG recortado gerado pelo worker
      const rawCutoutBuffer = fs.readFileSync(outputPath);

      // 5. Valida os metadados do recorte (canal alpha e dimensões)
      const metaOut = await sharp(rawCutoutBuffer).metadata();
      if (!metaOut.hasAlpha || (metaOut.channels !== 4 && metaOut.channels !== 2)) {
        throw new Error('Não foi possível separar a pessoa do fundo: canal de transparência alpha ausente.');
      }

      // 6. Analisa a distribuição de pixels para garantir remoção real do fundo
      const { data, info } = await sharp(rawCutoutBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let transparentPixels = 0;
      let nonZeroPixels = 0;
      const totalPixels = info.width * info.height;

      for (let i = 0; i < data.length; i += info.channels) {
        const alpha = data[i + info.channels - 1];
        if (alpha === 0) {
          transparentPixels++;
        } else if (alpha > 30) {
          nonZeroPixels++;
        }
      }

      const transparentRatio = transparentPixels / totalPixels;

      // Se não há pixels transparentes (ou quase nenhum), o fundo não foi removido
      if (transparentRatio < 0.05) {
        throw new Error('Não foi possível separar a pessoa do fundo: a imagem permaneceu retangular.');
      }

      // Se não há sujeito detectado
      if (nonZeroPixels === 0) {
        throw new Error('Não foi possível separar a pessoa do fundo: nenhum sujeito detectado no recorte.');
      }

      const cutoutDataUrl = `data:image/png;base64,${rawCutoutBuffer.toString('base64')}`;

      return {
        cutoutBuffer: rawCutoutBuffer,
        cutoutDataUrl,
        width: metaOut.width || 800,
        height: metaOut.height || 800,
        hasAlpha: true,
        transparentPixelRatio: transparentRatio,
      };
    } catch (err: any) {
      console.warn('[SubjectSegmentationService] Falha na segmentação do sujeito:', err?.message || err);
      if (err.message && err.message.startsWith('Não foi possível separar')) {
        throw err;
      }
      throw new Error('Não foi possível separar a pessoa do fundo.');
    } finally {
      // Limpeza segura dos arquivos temporários
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      } catch {}
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  }

  /**
   * Verifica rapidamente se um buffer já é um cutout com transparência alpha válida
   */
  public static async isAlphaCutout(buffer: Buffer): Promise<boolean> {
    try {
      const meta = await sharp(buffer).metadata();
      if (!meta.hasAlpha || meta.channels !== 4) return false;

      const { data, info } = await sharp(buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let transparentPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) transparentPixels++;
      }

      return transparentPixels / (info.width * info.height) >= 0.05;
    } catch {
      return false;
    }
  }
}
