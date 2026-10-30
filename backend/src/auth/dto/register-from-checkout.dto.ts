export class RegisterFromCheckoutDto {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  regionId?: number;
  communeId?: number;
  vendorId: string;
  zipCode?: string;
}
