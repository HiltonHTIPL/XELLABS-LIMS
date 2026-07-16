from django.apps import AppConfig


class InstrumentsConfig(AppConfig):
    name = "instruments"

    def ready(self):
        from .signals import connect_usability_signals
        connect_usability_signals()
