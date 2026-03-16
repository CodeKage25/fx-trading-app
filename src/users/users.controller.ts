import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './user.entity';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all registered users (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of all users' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getAllUsers() {
    return this.usersService.findAll();
  }
}
