import { Module } from '@nestjs/common';

import { ArticleProvider } from './article/article.provider';
import { WikipediaProvider } from './article/wikipedia.provider';
import { CuratedArticleProvider } from './article/curated/curated-article.provider';
import { ArticleSelectorService } from './article/article-selector.service';
import { PedantixEngineService } from './pedantix-engine.service';
import { TokenizerService } from './tokenizer/tokenizer.service';
import { ArticleViewService } from './article-view/article-view.service';
import { LemmatizerService } from './linguistics/lemmatizer.service';
import { VectorStoreService } from './proximity/vector-store.service';
import { ArticleIndexService } from './matching/article-index';
import { ProximityService } from './proximity/proximity.service';
import { GuessEngineService } from './guess/guess-engine.service';

@Module({
  providers: [
    WikipediaProvider,
    CuratedArticleProvider,
    {
      provide: ArticleProvider,
      useExisting: WikipediaProvider,
    },
    ArticleSelectorService,
    PedantixEngineService,
    TokenizerService,
    ArticleViewService,
    LemmatizerService,
    VectorStoreService,
    ArticleIndexService,
    ProximityService,
    GuessEngineService,
  ],
  exports: [ArticleProvider, PedantixEngineService],
})
export class PedantixEngineModule {}
