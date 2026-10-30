import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserCreatedBy, UserRole } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { RegisterFromCheckoutDto } from './dto/register-from-checkout.dto';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private jwtService: JwtService,
    private customersService: CustomersService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    // Recargar con relaciones
    const userWithVendor = await this.usersRepository.findOne({
      where: { id: savedUser.id },
      relations: ['vendor'],
    });

    const { password, ...result } = userWithVendor || savedUser;
    return {
      user: result,
      access_token: this.generateToken(userWithVendor || savedUser),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Load vendor relation only if user is a vendor
    if (user.role === 'vendor') {
      const userWithVendor = await this.usersRepository.findOne({
        where: { id: user.id },
        relations: ['vendor'],
      });
      if (userWithVendor) {
        const { password, ...result } = userWithVendor;
        return {
          user: result,
          access_token: this.generateToken(userWithVendor),
          requirePasswordChange: userWithVendor.requirePasswordChange || false,
        };
      }
    }

    const { password, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
      requirePasswordChange: user.requirePasswordChange || false,
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      vendorId: user.vendor?.id || null,
    };
    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['vendor'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...result } = user;
    return {
      ...result,
      vendorId: user.vendor?.id || null,
    };
  }

  // Generar contraseña temporal aleatoria de 10 dígitos
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async registerFromCheckout(registerDto: RegisterFromCheckoutDto) {
    // Verificar si el usuario ya existe
    let user = await this.usersRepository.findOne({
      where: { email: registerDto.email },
      relations: ['customerProfile'],
    });

    if (user && user.role === UserRole.CUSTOMER) {
      // Usuario existente, solo crear/actualizar perfil de cliente
      await this.customersService.createProfileFromCheckout(user.id, {
        phone: registerDto.phone,
        address: registerDto.address,
        city: registerDto.city,
        regionId: registerDto.regionId,
        communeId: registerDto.communeId,
        zipCode: registerDto.zipCode,
      });

      const { password, ...result } = user;
      return {
        user: result,
        tempPassword: null,
        isNew: false,
      };
    }

    if (user && user.role !== UserRole.CUSTOMER) {
      throw new ConflictException(
        'Email already registered as vendor or admin',
      );
    }

    // Crear nuevo usuario
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = this.usersRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      role: UserRole.CUSTOMER,
      createdBy: UserCreatedBy.CHECKOUT_ORDER,
      tempPassword: tempPassword, // Guardar en plaintext solo en creación
    });

    const savedUser = await this.usersRepository.save(newUser);

    // Crear perfil de cliente
    await this.customersService.createProfileFromCheckout(savedUser.id, {
      phone: registerDto.phone,
      address: registerDto.address,
      city: registerDto.city,
      regionId: registerDto.regionId,
      communeId: registerDto.communeId,
      zipCode: registerDto.zipCode,
    });

    const { password, ...result } = savedUser;
    return {
      user: result,
      tempPassword,
      isNew: true,
    };
  }


  async createStoreSsoUrl(userId: string, vendorId?: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['vendor'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    let vendor: Vendor | null = null;

    if (user.role === UserRole.ADMIN) {
      if (vendorId) {
        vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
      } else if (user.vendor?.id) {
        vendor = user.vendor;
      }
    } else if (user.role === UserRole.VENDOR && user.vendor?.id) {
      vendor = user.vendor;
      if (vendorId && vendorId !== vendor.id) {
        throw new UnauthorizedException('No puedes acceder a esta tienda');
      }
    }

    if (!vendor) {
      throw new UnauthorizedException('No vendor profile found');
    }

    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        vendorId: vendor.id,
        purpose: 'store-sso',
      },
      { expiresIn: '5m' as any },
    );

    const origin = vendor.customDomain && vendor.customDomainVerified
      ? `https://${vendor.customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/tiendas/${vendor.slug}`;

    return {
      url: `${origin}/admin-login?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 300,
      vendor: {
        id: vendor.id,
        slug: vendor.slug,
        storeName: vendor.storeName,
      },
    };
  }

  async consumeStoreSsoToken(token: string, vendorSlug: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (payload?.purpose !== 'store-sso' || !payload.sub || !payload.vendorId) {
      throw new UnauthorizedException('Token inválido');
    }

    const vendor = await this.vendorsRepository.findOne({ where: { id: payload.vendorId } });
    if (!vendor || vendor.slug !== vendorSlug) {
      throw new UnauthorizedException('Token no corresponde a esta tienda');
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
      relations: ['vendor'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== UserRole.ADMIN && user.vendor?.id !== vendor.id) {
      throw new UnauthorizedException('No autorizado para esta tienda');
    }

    const { password, ...result } = user;
    return {
      user: {
        ...result,
        vendorId: user.vendor?.id || null,
      },
      access_token: this.generateToken(user),
    };
  }
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If user requires password change (first login with temp password), skip current password check
    if (!user.requirePasswordChange && currentPassword) {
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and remove requirePasswordChange flag
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      requirePasswordChange: false,
      tempPassword: undefined, // Clear temp password if exists
    });

    return {
      message: 'Password changed successfully',
      requirePasswordChange: false,
    };
  }
}
