
import { Controller, Post, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Controller('uploads')
export class UploadController {
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, { // Accept up to 10 files at once
    storage: new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'voyagora',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      } as any,
    }),
  }))
  uploadFiles(@UploadedFiles() files: any[]) {
    // Return an array of secure URLs
    return { urls: files.map(file => file.path) };
  }
}
