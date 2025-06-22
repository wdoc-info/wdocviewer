import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import JSZip from 'jszip';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('processHtml should strip script and iframe tags', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head></head><body><wdoc-page></wdoc-page><script src="foo.js"></script><iframe></iframe><div>ok</div></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    expect(result).not.toContain('<script');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('ok');
  });
});
