import JSZip from 'jszip';

const MAX_XML = 10 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;
export const acceptsFiscalFile = name => /\.(xml|zip)$/i.test(name);

// Decode archives locally; send one XML at a time so PDF generation cannot
// turn a large archive into a single long-running HTTP request.
export async function importFiscalFiles(files, upload, progress = () => {}) {
  const result = { processed: 0, errors: [] };
  let total = 0, attempted = 0;
  async function send(name, bytes) {
    if (bytes.byteLength > MAX_XML) throw new Error('XML excede 10 MB.');
    total += bytes.byteLength;
    if (total > MAX_TOTAL) throw new Error('Lote excede 200 MB descompactados; divida os arquivos.');
    const response = await upload(new File([bytes], name, { type: 'application/xml' }));
    result.processed += response.processed;
    result.errors.push(...(response.errors || []));
    progress(++attempted, result.processed);
  }
  for (const file of files) {
    try {
      if (!acceptsFiscalFile(file.name)) throw new Error('Formato não suportado; selecione XML ou ZIP.');
      if (file.size > MAX_TOTAL) throw new Error('Arquivo excede 200 MB.');
      if (/\.xml$/i.test(file.name)) {
        if (file.size > MAX_XML) throw new Error('XML excede 10 MB.');
        await send(file.name, await file.arrayBuffer());
      } else {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.xml$/i.test(entry.name));
        if (!entries.length) throw new Error('ZIP não contém arquivos XML.');
        if (entries.length > 10000) throw new Error('ZIP excede 10.000 XMLs; divida o lote.');
        // JSZip exposes the declared size before decompression. Bound both
        // that declaration and actual decompressed bytes.
        for (const entry of entries) {
          if (!Number.isFinite(entry._data?.uncompressedSize) || entry._data.uncompressedSize > MAX_XML)
            throw new Error('XML no ZIP excede 10 MB ou possui tamanho inválido.');
        }
        if (total + entries.reduce((sum, entry) => sum + entry._data.uncompressedSize, 0) > MAX_TOTAL)
          throw new Error('Lote excede 200 MB descompactados; divida os arquivos.');
        for (const entry of entries) {
          try { await send(entry.name, await entry.async('uint8array')); }
          catch (error) { result.errors.push(`${file.name}/${entry.name}: ${error.message}`); }
        }
      }
    } catch (error) { result.errors.push(`${file.name}: ${error.message}`); }
  }
  return result;
}
