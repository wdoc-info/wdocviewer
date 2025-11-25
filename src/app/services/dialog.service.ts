import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AlertDialogComponent } from './alert-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
  constructor(private dialog: MatDialog) {}

  openAlert(message: string, title?: string): Promise<void> {
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      data: { message, title },
      width: '360px',
    });

    return firstValueFrom(dialogRef.afterClosed());
  }
}
