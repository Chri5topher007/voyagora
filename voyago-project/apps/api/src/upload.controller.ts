
import { Controller, Post, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { JwtAuthGuard } from './jwt-auth.guard';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Controller('uploads')
export class UploadController {
  // NOTE: this endpoint previously had no auth guard at all — anyone on the
  // internet could upload arbitrary files to the Cloudinary account and run
  // up storage/bandwidth costs. Now requires a logged-in user.
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, { // Accept up to 10 files at once
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    storage: new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'voyagora',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      } as any,
    }),
  }))
  uploadFiles(@UploadedFiles() files: any[]) {
    return { urls: files.map(file => file.path) };
  }
}
