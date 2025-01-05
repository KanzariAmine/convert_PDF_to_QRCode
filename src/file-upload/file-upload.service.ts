import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
@Injectable()
export class FileUploadService {
  private readonly baseDir = path.join(__dirname, '../../uploads'); // Define your directory

  // Method to fetch all file names
  getAllFiles(): string[] {
    try {
      const files = fs.readdirSync(this.baseDir);
      return files;
    } catch (error) {
      throw new Error(`Error reading files: ${error.message}`);
    }
  }

  deleteFile(fileName: string): object {
    const filePath = path.join(this.baseDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File ${fileName} not found`);
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file: ${err?.message}`);
        throw new Error(`Could not delete file: ${err?.message}`);
      }
      this.deleteQRCode(fileName);
    });

    return {
      status: 200,
      message: `File ${fileName} deleted successfully`,
    };
  }

  private deleteQRCode(filename) {
    const QRCodeName = `${filename}-qrcode.png`;
    const QRCodePath = path.join(this.baseDir, QRCodeName);
    if (!fs.existsSync(QRCodePath)) {
      throw new NotFoundException(`File ${QRCodeName} not found`);
    }

    fs.unlink(QRCodePath, (err) => {
      if (err) {
        console.error(`Error deleting file: ${err?.message}`);
        throw new Error(`Could not delete file: ${err?.message}`);
      }
    });
  }

  async handleFileUpload(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No File Uploaded');
    }
    //Validation file MappedType
    const allowedMimeTypes = ['application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid File Type');
    }
    // validate file size (e.g., max 5mb)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File is too Large!');
    }

    try {
      // File URL setup
      const serverUrl = 'http://192.168.43.37:3000';
      const fileUrl = `${serverUrl}/uploads/${file.filename}`;
      const qrCodeFilename = `${file.filename}-qrcode.png`;
      const qrCodePath = path.join(__dirname, '../../uploads', qrCodeFilename);

      // QR Code generation with logo
      await this.generateQRCodeWithLogo(fileUrl, qrCodePath);
      const qrCodeUrl = `${serverUrl}/uploads/${qrCodeFilename}`;
      return {
        message: 'File uploaded and QR Code generated successfully',
        filePath: file.path,
        qrCodeUrl,
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to process the file or generate QR code',
      );
    }

    // return new Promise((resolve, reject) => {
    //   QRCode.toFile(
    //     qrCodePath,
    //     fileUrl, // Encode the file URL
    //     { width: 300 }, // Set QR code image size
    //     (err) => {
    //       if (err) {
    //         reject(new BadRequestException('Failed to generate QR Code'));
    //       } else {
    //         const qrCodeUrl = `${serverUrl}/uploads/${qrCodeFilename}`;
    //         resolve({
    //           message: 'File uploaded and QR Code generated successfully',
    //           filePath: file.path,
    //           qrCodeUrl,
    //         });
    //       }
    //     },
    //   );
    // });
  }

  private generateQRCodeWithLogo(
    data: string,
    outputPath: string,
  ): Promise<void> {
    // Path to your logo file
    const logopath = path.join(__dirname, '../../assets/kanpower_logo.jpg');

    return new Promise((resolve, reject) => {
      try {
        // Step 1: Generate QR code as a canvas
        const canvas = createCanvas(500, 500);
        QRCode.toCanvas(canvas, data, { errorCorrectionLevel: 'H', margin: 2 })
          .then(async () => {
            // Step 2: Load the logo image
            const cxt = canvas.getContext('2d');
            const logo = await loadImage(logopath);

            // Step 3: Draw the logo on the center of the QR code
            const logoSize = canvas.width * 0.2; // Logo size (20% of QR code width)
            const logoX = (canvas.width - logoSize) / 2; // Center horizontally
            const logoY = (canvas.height - logoSize) / 2; // Center vertically

            cxt.drawImage(logo, logoX, logoY, logoSize, logoSize);

            // Step 4: Save the QR code with the logo to a file
            const buffer = canvas.toBuffer('image/png');
            fs.writeFile(outputPath, buffer, (err) => {
              if (err)
                reject(
                  new BadRequestException('Failed to save QR Code with logo'),
                );
              else resolve();
            });
          })
          .catch(() =>
            reject(new BadRequestException('Failed to generate QR Code')),
          );
      } catch (error) {
        reject(
          new BadRequestException(
            'Error during QR Code generation with logo!!! ',
          ),
        );
      }
    });
  }
}
