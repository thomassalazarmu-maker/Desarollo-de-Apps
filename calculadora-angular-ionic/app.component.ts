import { Component } from '@angular/core';

interface HistorialItem {
  num1: number;
  num2: number;
  operacion: string;
  resultado: number;
  fecha: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  num1: number | null = null;
  num2: number | null = null;
  operacion: string = '+';
  resultado: number | null = null;

  historico: HistorialItem[] = [];

  calcular(): void {
    if (this.num1 === null || this.num2 === null) {
      alert('Por favor ingresa ambos números');
      return;
    }

    let resultadoCalculado: number;

    switch (this.operacion) {
      case '+':
        resultadoCalculado = this.num1 + this.num2;
        break;
      case '-':
        resultadoCalculado = this.num1 - this.num2;
        break;
      case '*':
        resultadoCalculado = this.num1 * this.num2;
        break;
      case '/':
        if (this.num2 === 0) {
          alert('No se puede dividir entre cero');
          return;
        }
        resultadoCalculado = this.num1 / this.num2;
        break;
      default:
        return;
    }

    this.resultado = resultadoCalculado;

    // Agregar al histórico (al inicio de la lista)
    this.historico.unshift({
      num1: this.num1,
      num2: this.num2,
      operacion: this.operacion,
      resultado: resultadoCalculado,
      fecha: new Date()
    });
  }

  limpiarHistorico(): void {
    this.historico = [];
  }

  limpiarCampos(): void {
    this.num1 = null;
    this.num2 = null;
    this.operacion = '+';
    this.resultado = null;
  }

  obtenerSimboloOperacion(op: string): string {
    const simbolos: { [key: string]: string } = {
      '+': '+',
      '-': '-',
      '*': '×',
      '/': '÷'
    };
    return simbolos[op] || op;
  }
}
