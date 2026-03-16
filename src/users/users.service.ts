import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async save(user: Partial<User>): Promise<User> {
    return this.usersRepository.save(user);
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<Partial<User>[]> {
    return this.usersRepository.find({
      select: ['id', 'email', 'role', 'isVerified', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }
}
