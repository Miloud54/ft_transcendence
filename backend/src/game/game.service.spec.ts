import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { GameService } from './game.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PedantixEngineService } from 'src/pedantix-engine/pedantix-engine.service';
import { GameStatus, RoomStatus } from 'generated/prisma';

describe('GameService', () => {
  let service: GameService;

  let prisma: {
    game: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    room: {
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let pedantixEngine: {
    prepareGame: jest.Mock;
    isGamePrepared: jest.Mock;
  };

  const gameId = '123';
  const roomId = BigInt(456);

  const game = {
    game_id: BigInt(gameId),
    room_id: roomId,
    status: GameStatus.COUNTDOWN,
  };

  beforeEach(async () => {
    prisma = {
      game: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      room: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => Promise<void>) =>
        callback(prisma),
    );

    pedantixEngine = {
      prepareGame: jest.fn().mockResolvedValue(undefined),
      isGamePrepared: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: PedantixEngineService,
          useValue: pedantixEngine,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startCountdown', () => {
    it('throws NotFoundException if the game does not exist', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.startCountdown(gameId)).rejects.toThrow(
        NotFoundException,
      );

      expect(pedantixEngine.prepareGame).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the game is not in COUNTDOWN', async () => {
      prisma.game.findUnique.mockResolvedValue({
        ...game,
        status: GameStatus.RUNNING,
      });

      await expect(service.startCountdown(gameId)).rejects.toThrow(
        ConflictException,
      );

      expect(pedantixEngine.prepareGame).not.toHaveBeenCalled();
    });

    it('starts preparing the game immediately', async () => {
      jest.useFakeTimers();

      prisma.game.findUnique.mockResolvedValue(game);

      await service.startCountdown(gameId);

      expect(pedantixEngine.prepareGame).toHaveBeenCalledTimes(1);
      expect(pedantixEngine.prepareGame).toHaveBeenCalledWith(gameId);
    });

    it('does not transition to RUNNING before the 10-second countdown ends', async () => {
      jest.useFakeTimers();

      prisma.game.findUnique.mockResolvedValue(game);
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.room.update.mockResolvedValue({});

      await service.startCountdown(gameId);

      await jest.advanceTimersByTimeAsync(9_999);

      expect(prisma.game.updateMany).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: {
          game_id: BigInt(gameId),
          status: GameStatus.COUNTDOWN,
        },
        data: {
          status: GameStatus.RUNNING,
        },
      });

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: {
          room_id: roomId,
        },
        data: {
          status: RoomStatus.IN_GAME,
        },
      });
    });

    it('waits for preparation if it takes longer than 10 seconds', async () => {
      jest.useFakeTimers();

      let resolvePreparation!: () => void;

      const preparation = new Promise<void>((resolve) => {
        resolvePreparation = resolve;
      });

      prisma.game.findUnique.mockResolvedValue(game);
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.room.update.mockResolvedValue({});

      pedantixEngine.prepareGame.mockReturnValue(preparation);

      await service.startCountdown(gameId);

      expect(pedantixEngine.prepareGame).toHaveBeenCalledWith(gameId);

      // Le compte à rebours est terminé, mais le moteur travaille encore.
      await jest.advanceTimersByTimeAsync(10_000);

      expect(prisma.game.updateMany).not.toHaveBeenCalled();
      expect(prisma.room.update).not.toHaveBeenCalled();

      // La préparation se termine après 12 secondes.
      await jest.advanceTimersByTimeAsync(2_000);

      resolvePreparation();

      // Laisse les continuations asynchrones s'exécuter.
      await jest.advanceTimersByTimeAsync(0);

      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: {
          game_id: BigInt(gameId),
          status: GameStatus.COUNTDOWN,
        },
        data: {
          status: GameStatus.RUNNING,
        },
      });

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: {
          room_id: roomId,
        },
        data: {
          status: RoomStatus.IN_GAME,
        },
      });
    });

    it('does not transition to RUNNING if preparation fails', async () => {
      jest.useFakeTimers();

      prisma.game.findUnique.mockResolvedValue(game);

      const preparationError = new Error('Article preparation failed');

      pedantixEngine.prepareGame.mockRejectedValue(preparationError);

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await service.startCountdown(gameId);

      await jest.advanceTimersByTimeAsync(10_000);

      expect(prisma.game.updateMany).not.toHaveBeenCalled();
      expect(prisma.room.update).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('does not start multiple countdowns for the same game', async () => {
      jest.useFakeTimers();

      prisma.game.findUnique.mockResolvedValue(game);
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.room.update.mockResolvedValue({});

      await service.startCountdown(gameId);
      await service.startCountdown(gameId);

      expect(pedantixEngine.prepareGame).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(10_000);

      expect(prisma.game.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.room.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('transitionToRunning', () => {
    it('throws NotFoundException if the game does not exist', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.transitionToRunning(gameId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if the game is not in COUNTDOWN', async () => {
      prisma.game.findUnique.mockResolvedValue({
        ...game,
        status: GameStatus.RUNNING,
      });

      await expect(service.transitionToRunning(gameId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('updates the game and room statuses', async () => {
      prisma.game.findUnique.mockResolvedValue(game);
      prisma.game.updateMany.mockResolvedValue({ count: 1 });
      prisma.room.update.mockResolvedValue({});

      await service.transitionToRunning(gameId);

      expect(prisma.game.updateMany).toHaveBeenCalledWith({
        where: {
          game_id: BigInt(gameId),
          status: GameStatus.COUNTDOWN,
        },
        data: {
          status: GameStatus.RUNNING,
        },
      });

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: {
          room_id: roomId,
        },
        data: {
          status: RoomStatus.IN_GAME,
        },
      });
    });
  });
});
