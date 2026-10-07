import { Module } from '@nestjs/common';
import { ArticleProvider } from './article/article.provider';
import { WikipediaProvider } from './article/wikipedia.provider';
import { ArticleSelectorService } from './article/article-selector.service';

@Module({
  providers: [
    WikipediaProvider,
    {
      provide: ArticleProvider,
      useExisting: WikipediaProvider,
    },
    ArticleSelectorService,
  ],
  exports: [ArticleProvider],
})
export class PedantixEngineModule {}
