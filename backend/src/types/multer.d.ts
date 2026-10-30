// Declara el namespace Express.Multer.File para ser compatible con
// @types/express@4 y @types/express@5 (que elimina el namespace global Express)
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
        stream: import('stream').Readable;
      }
    }
  }
}

export {};
