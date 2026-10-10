import { Module } from '@nestjs/common';
import { ArticleProvider } from './article/article.provider';
import { WikipediaProvider } from './article/wikipedia.provider';
import { ArticleSelectorService } from './article/article-selector.service';
import { PedantixEngineService } from './pedantix-engine.service';
import { TokenizerService } from './tokenizer/tokenizer.service';

@Module({
  providers: [
    WikipediaProvider,
    {
      provide: ArticleProvider,
      useExisting: WikipediaProvider,
    },
    ArticleSelectorService,
    PedantixEngineService,
    TokenizerService,
  ],
  exports: [ArticleProvider, PedantixEngineService],
})
export class PedantixEngineModule {}
