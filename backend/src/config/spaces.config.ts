import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createSpacesClient = (configService: ConfigService) => {
  const spacesEndpoint = configService.get<string>('SPACES_ENDPOINT');
  const spacesRegion = configService.get<string>('SPACES_REGION', 'nyc3');
  const spacesAccessKey = configService.get<string>('SPACES_ACCESS_KEY');
  const spacesSecretKey = configService.get<string>('SPACES_SECRET_KEY');

  if (!spacesAccessKey || !spacesSecretKey) {
    console.warn('⚠️  DigitalOcean Spaces credentials not configured. Using local storage.');
    return null;
  }

  return new S3Client({
    endpoint: spacesEndpoint,
    region: spacesRegion,
    credentials: {
      accessKeyId: spacesAccessKey,
      secretAccessKey: spacesSecretKey,
    },
    forcePathStyle: false,
  });
};

export const getSpacesConfig = (configService: ConfigService) => ({
  client: createSpacesClient(configService),
  bucket: configService.get<string>('SPACES_BUCKET'),
  cdnUrl: configService.get<string>('SPACES_CDN_URL'),
  region: configService.get<string>('SPACES_REGION', 'nyc3'),
});
