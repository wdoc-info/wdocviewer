import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, map } from 'rxjs';
import {
  MessageDialogComponent,
  MessageDialogData,
} from '../dialogs/message-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
  constructor(private dialog: MatDialog) {}

  alert(message: string, title = 'Notice'): Promise<void> {
    return firstValueFrom(
      this.dialog
        .open(MessageDialogComponent, {
          data: this.buildDialogData(title, message),
        })
        .afterClosed(),
    );
  }

  confirm(message: string, title = 'Confirm'): Promise<boolean> {
    return firstValueFrom(
      this.dialog
        .open(MessageDialogComponent, {
          data: this.buildDialogData(title, message, true),
        })
        .afterClosed()
        .pipe(map((result) => Boolean(result))),
    );
  }

  private buildDialogData(
    title: string,
    message: string,
    confirm = false,
  ): MessageDialogData {
    return { title, message, confirm };
  }
}
